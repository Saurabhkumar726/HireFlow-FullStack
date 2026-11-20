using System;

namespace HireFlow.Api.DTOs
{
    public sealed record CityLocationDto(
        int Id,
        string City,
        string State,
        string DisplayName);

    public sealed record CityLocationSyncResultDto(
        int Added,
        int Updated,
        int Deactivated,
        int TotalActive,
        int Skipped,
        DateTime SyncedAtUtc,
        string Source);
}