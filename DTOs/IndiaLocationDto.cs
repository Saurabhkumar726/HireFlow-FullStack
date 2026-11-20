namespace HireFlow.Api.DTOs;

public sealed record IndiaLocationDto(
    int Id,
    string Code,
    string Name,
    string Type,
    string? LocalName,
    string? StateCode,
    string? StateName,
    string? DistrictCode,
    string? DistrictName,
    string? Pincode,
    string? LocalBodyType,
    string? OfficeType,
    string? DeliveryStatus,
    string? CircleName,
    string? RegionName,
    string? DivisionName,
    int? ParentId);

public sealed record IndiaLocationImportResultDto(
    string Dataset,
    string DataSource,
    string LocationType,
    int RowsRead,
    int RowsInserted,
    int RowsUpdated,
    int RowsSkipped,
    int RowsDeactivated,
    DateTime ImportedAtUtc);
