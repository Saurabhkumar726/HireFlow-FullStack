using HireFlow.Api.Data;
using HireFlow.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/locations")]
    [AllowAnonymous]
    public sealed class LocationsController : ControllerBase
    {
        private readonly HireFlowDbContext _dbContext;

        public LocationsController(HireFlowDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Search Indian city/state suggestions for the website location field.
        /// Example: GET /api/locations/search?q=indore
        /// </summary>
        [HttpGet("search")]
        [ProducesResponseType(typeof(IReadOnlyList<CityLocationDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<IReadOnlyList<CityLocationDto>>> Search(
            [FromQuery(Name = "q")] string? searchTerm,
            [FromQuery] int limit = 10,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(searchTerm) || searchTerm.Trim().Length < 2)
            {
                return Ok(Array.Empty<CityLocationDto>());
            }

            if (searchTerm.Trim().Length > 100)
            {
                return BadRequest(new { message = "Search text cannot exceed 100 characters." });
            }

            var normalizedSearch = searchTerm.Trim().ToUpper(CultureInfo.InvariantCulture);
            limit = Math.Clamp(limit, 1, 20);

            var results = await _dbContext.CityLocations
                .AsNoTracking()
                .Where(city => city.IsActive &&
                    (city.NormalizedCityName.StartsWith(normalizedSearch) ||
                     city.NormalizedDisplayName.StartsWith(normalizedSearch)))
                .OrderByDescending(city => city.NormalizedDisplayName == normalizedSearch)
                .ThenByDescending(city => city.NormalizedCityName == normalizedSearch)
                .ThenBy(city => city.CityName)
                .ThenBy(city => city.StateName)
                .Take(limit)
                .Select(city => new CityLocationDto(
                    city.Id,
                    city.CityName,
                    city.StateName,
                    city.CityName + ", " + city.StateName))
                .ToListAsync(cancellationToken);

            return Ok(results);
        }
    }
}