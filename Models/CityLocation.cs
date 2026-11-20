namespace HireFlow.Api.Models
{
    /// <summary>
    /// A searchable Indian city/state pair used by the website location field.
    /// Intentionally stores no PIN code, village, block, sub-district or local-body data.
    /// </summary>
    public class CityLocation
    {
        public int Id { get; set; }

        public string CityName { get; set; } = string.Empty;

        public string StateName { get; set; } = string.Empty;

        public string NormalizedCityName { get; set; } = string.Empty;

        public string NormalizedStateName { get; set; } = string.Empty;

        public string NormalizedDisplayName { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime LastSyncedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
