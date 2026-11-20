using HireFlow.Api.DTOs;
using HireFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HireFlow.Api.Controllers
{
    [ApiController]
    [Route("api/location-admin")]
    [Authorize(Roles = "Admin")]
    public sealed class LocationAdminController : ControllerBase
    {
        private readonly CityLocationSyncService _cityLocationSyncService;
        private readonly ILogger<LocationAdminController> _logger;

        public LocationAdminController(
            CityLocationSyncService cityLocationSyncService,
            ILogger<LocationAdminController> logger)
        {
            _cityLocationSyncService = cityLocationSyncService;
            _logger = logger;
        }

        /// <summary>
        /// One-time/admin-triggered download and synchronization of Indian city/state names.
        /// No CSV upload or third-party API key is required.
        /// </summary>
        [HttpPost("sync-cities")]
        [ProducesResponseType(typeof(CityLocationSyncResultDto), StatusCodes.Status200OK)]
        public async Task<ActionResult<CityLocationSyncResultDto>> SyncCities(
            CancellationToken cancellationToken)
        {
            try
            {
                var result = await _cityLocationSyncService
                    .SyncIndianCitiesAsync(cancellationToken);

                return Ok(result);
            }
            catch (HttpRequestException exception)
            {
                _logger.LogError(exception, "The GeoNames city directory could not be downloaded.");
                return StatusCode(StatusCodes.Status502BadGateway, new
                {
                    message = "The city directory source is temporarily unavailable. No existing location records were changed."
                });
            }
            catch (InvalidDataException exception)
            {
                _logger.LogError(exception, "The downloaded city directory was invalid.");
                return BadRequest(new { message = exception.Message });
            }
        }
    }
}