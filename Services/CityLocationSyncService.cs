using System.Globalization;
using System.IO.Compression;
using System.Text;
using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using HireFlow.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HireFlow.Api.Services
{
    /// <summary>
    /// Downloads the GeoNames city extract and stores only Indian city/state names.
    /// The source is synchronized manually by an Admin; website searches use SQL Server.
    /// </summary>
    public sealed class CityLocationSyncService
    {
        private const string CitiesArchiveUrl =
            "https://download.geonames.org/export/dump/cities500.zip";

        private const string Admin1CodesUrl =
            "https://download.geonames.org/export/dump/admin1CodesASCII.txt";

        private const string SourceName = "GeoNames cities500 (India city/state subset)";

        // These GeoNames feature codes identify administrative seats/capitals,
        // rather than ordinary villages or generic populated-place records.
        private static readonly HashSet<string> CityFeatureCodes = new(
            StringComparer.OrdinalIgnoreCase)
        {
            "PPLC",  // National capital
            "PPLA",  // First-order administrative seat
            "PPLA2", // Second-order administrative seat
            "PPLA3", // Third-order administrative seat
            "PPLA4", // Fourth-order administrative seat
            "PPLG"   // Seat of government
        };

        private readonly HttpClient _httpClient;
        private readonly HireFlowDbContext _dbContext;
        private readonly ILogger<CityLocationSyncService> _logger;

        public CityLocationSyncService(
            HttpClient httpClient,
            HireFlowDbContext dbContext,
            ILogger<CityLocationSyncService> logger)
        {
            _httpClient = httpClient;
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<CityLocationSyncResultDto> SyncIndianCitiesAsync(
            CancellationToken cancellationToken = default)
        {
            var admin1Text = await _httpClient.GetStringAsync(
                Admin1CodesUrl,
                cancellationToken);

            var stateNames = ParseIndianStateNames(admin1Text);

            if (stateNames.Count == 0)
            {
                throw new InvalidDataException(
                    "The GeoNames state-code file did not contain Indian state names.");
            }

            using var response = await _httpClient.GetAsync(
                CitiesArchiveUrl,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            response.EnsureSuccessStatusCode();

            await using var responseStream = await response.Content.ReadAsStreamAsync(
                cancellationToken);

            await using var archiveBuffer = new MemoryStream();

            await responseStream.CopyToAsync(
                archiveBuffer,
                cancellationToken);

            archiveBuffer.Position = 0;

            using var archive = new ZipArchive(
                archiveBuffer,
                ZipArchiveMode.Read,
                leaveOpen: false);

            var citiesEntry = archive.Entries.FirstOrDefault(entry =>
                string.Equals(
                    entry.Name,
                    "cities500.txt",
                    StringComparison.OrdinalIgnoreCase));

            if (citiesEntry == null)
            {
                throw new InvalidDataException(
                    "The GeoNames archive did not contain cities500.txt.");
            }

            var incoming = new Dictionary<string, CityLocation>(
                StringComparer.Ordinal);

            var skipped = 0;
            var now = DateTime.UtcNow;

            await using (var entryStream = citiesEntry.Open())
            using (var reader = new StreamReader(
                entryStream,
                Encoding.UTF8,
                detectEncodingFromByteOrderMarks: true))
            {
                while (await reader.ReadLineAsync(cancellationToken) is { } line)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    if (string.IsNullOrWhiteSpace(line))
                    {
                        continue;
                    }

                    var fields = line.Split('\t');

                    if (fields.Length < 19 ||
                        !string.Equals(
                            fields[8],
                            "IN",
                            StringComparison.OrdinalIgnoreCase) ||
                        !string.Equals(
                            fields[6],
                            "P",
                            StringComparison.OrdinalIgnoreCase))
                    {
                        skipped++;
                        continue;
                    }

                    var featureCode = fields[7].Trim();

                    var population = long.TryParse(
                        fields[14],
                        NumberStyles.Integer,
                        CultureInfo.InvariantCulture,
                        out var parsedPopulation)
                        ? parsedPopulation
                        : 0;

                    // GeoNames uses PPL for cities, towns and villages. To avoid
                    // importing ordinary villages, include PPL rows only at 50,000+
                    // population; retain all administrative seats/capitals above.
                    var isAdministrativeCity =
                        CityFeatureCodes.Contains(featureCode);

                    var isLargePopulatedPlace =
                        string.Equals(
                            featureCode,
                            "PPL",
                            StringComparison.OrdinalIgnoreCase) &&
                        population >= 50_000;

                    if (!isAdministrativeCity && !isLargePopulatedPlace)
                    {
                        skipped++;
                        continue;
                    }

                    // Prefer the ASCII/transliterated name for the English-language
                    // location picker; fall back to the source's native display name.
                    var cityName = fields[2].Trim();

                    if (string.IsNullOrWhiteSpace(cityName))
                    {
                        cityName = fields[1].Trim();
                    }

                    var admin1Code = fields[10].Trim();
                    var stateKey = $"IN.{admin1Code}";

                    if (string.IsNullOrWhiteSpace(cityName) ||
                        !stateNames.TryGetValue(stateKey, out var stateName))
                    {
                        skipped++;
                        continue;
                    }

                    cityName = cityName.Trim();
                    stateName = stateName.Trim();

                    if (cityName.Length > 200 || stateName.Length > 120)
                    {
                        skipped++;
                        continue;
                    }

                    var normalizedCity = Normalize(cityName);
                    var normalizedState = Normalize(stateName);

                    var normalizedDisplay =
                        $"{normalizedCity}, {normalizedState}";

                    // A city can have multiple GeoNames records. Keep one suggestion
                    // for each visible City, State pair.
                    if (!incoming.ContainsKey(normalizedDisplay))
                    {
                        incoming[normalizedDisplay] = new CityLocation
                        {
                            CityName = cityName,
                            StateName = stateName,
                            NormalizedCityName = normalizedCity,
                            NormalizedStateName = normalizedState,
                            NormalizedDisplayName = normalizedDisplay,
                            IsActive = true,
                            LastSyncedAtUtc = now
                        };
                    }
                }
            }

            if (incoming.Count == 0)
            {
                throw new InvalidDataException(
                    "No Indian city/state records were found. Existing location data was not changed.");
            }

            var existingRows = await _dbContext.CityLocations
                .ToListAsync(cancellationToken);

            var existingByDisplayName = existingRows.ToDictionary(
                city => city.NormalizedDisplayName,
                StringComparer.Ordinal);

            var added = 0;
            var updated = 0;
            var deactivated = 0;

            foreach (var pair in incoming)
            {
                if (existingByDisplayName.TryGetValue(
                    pair.Key,
                    out var existing))
                {
                    existing.CityName = pair.Value.CityName;
                    existing.StateName = pair.Value.StateName;
                    existing.NormalizedCityName =
                        pair.Value.NormalizedCityName;

                    existing.NormalizedStateName =
                        pair.Value.NormalizedStateName;

                    existing.NormalizedDisplayName =
                        pair.Value.NormalizedDisplayName;

                    existing.IsActive = true;
                    existing.LastSyncedAtUtc = now;

                    updated++;
                }
                else
                {
                    _dbContext.CityLocations.Add(pair.Value);
                    added++;
                }
            }

            var incomingNames = incoming.Keys.ToHashSet(
                StringComparer.Ordinal);

            foreach (var existing in existingRows)
            {
                if (existing.IsActive &&
                    !incomingNames.Contains(existing.NormalizedDisplayName))
                {
                    existing.IsActive = false;
                    deactivated++;
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var totalActive = await _dbContext.CityLocations
                .CountAsync(
                    city => city.IsActive,
                    cancellationToken);

            _logger.LogInformation(
                "Synchronized Indian city/state suggestions. Added: {Added}, Updated: {Updated}, Deactivated: {Deactivated}, Active: {TotalActive}.",
                added,
                updated,
                deactivated,
                totalActive);

            return new CityLocationSyncResultDto(
                added,
                updated,
                deactivated,
                totalActive,
                skipped,
                now,
                SourceName);
        }

        private static Dictionary<string, string> ParseIndianStateNames(
            string fileContent)
        {
            var result = new Dictionary<string, string>(
                StringComparer.OrdinalIgnoreCase);

            using var reader = new StringReader(fileContent);

            while (reader.ReadLine() is { } line)
            {
                var fields = line.Split('\t');

                if (fields.Length < 2 ||
                    !fields[0].StartsWith(
                        "IN.",
                        StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var stateCode = fields[0].Trim();
                var stateName = fields[1].Trim();

                // Prefer the commonly used full Union Territory name in the UI.
                if (string.Equals(
                    stateCode,
                    "IN.01",
                    StringComparison.OrdinalIgnoreCase))
                {
                    stateName = "Andaman and Nicobar Islands";
                }

                if (!string.IsNullOrWhiteSpace(stateName))
                {
                    result[stateCode] = stateName;
                }
            }

            return result;
        }

        private static string Normalize(string value)
        {
            return value.Trim().ToUpper(CultureInfo.InvariantCulture);
        }
    }
}