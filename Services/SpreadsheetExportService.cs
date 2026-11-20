using System.Buffers;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace HireFlow.Api.Services;

public static class SpreadsheetExportService
{
    private static readonly XNamespace ContentTypesNamespace = "http://schemas.openxmlformats.org/package/2006/content-types";
    private static readonly XNamespace PackageRelationshipsNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";
    private static readonly XNamespace SpreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace OfficeRelationshipsNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    public static byte[] BuildCsv(IReadOnlyList<string[]> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        var builder = new StringBuilder();
        foreach (var row in rows)
        {
            builder.AppendLine(string.Join(",", row.Select(EscapeCsv)));
        }

        return Encoding.UTF8.GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(builder.ToString()))
            .ToArray();
    }

    public static byte[] BuildXlsx(IReadOnlyList<string[]> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);

        using var memory = new MemoryStream();

        using (var archive = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            // Every XML element is created in its actual namespace. Do not add an
            // unqualified root element and then manually assign its default xmlns;
            // that combination causes XmlWellFormedWriter namespace redefinition errors.
            AddXml(
                archive,
                "[Content_Types].xml",
                CreateDocument(
                    new XElement(
                        ContentTypesNamespace + "Types",
                        new XElement(
                            ContentTypesNamespace + "Default",
                            new XAttribute("Extension", "rels"),
                            new XAttribute("ContentType", "application/vnd.openxmlformats-package.relationships+xml")),
                        new XElement(
                            ContentTypesNamespace + "Default",
                            new XAttribute("Extension", "xml"),
                            new XAttribute("ContentType", "application/xml")),
                        new XElement(
                            ContentTypesNamespace + "Override",
                            new XAttribute("PartName", "/xl/workbook.xml"),
                            new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")),
                        new XElement(
                            ContentTypesNamespace + "Override",
                            new XAttribute("PartName", "/xl/worksheets/sheet1.xml"),
                            new XAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml")))));

            AddXml(
                archive,
                "_rels/.rels",
                CreateDocument(
                    new XElement(
                        PackageRelationshipsNamespace + "Relationships",
                        new XElement(
                            PackageRelationshipsNamespace + "Relationship",
                            new XAttribute("Id", "rId1"),
                            new XAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"),
                            new XAttribute("Target", "xl/workbook.xml")))));

            AddXml(
                archive,
                "xl/workbook.xml",
                CreateDocument(
                    new XElement(
                        SpreadsheetNamespace + "workbook",
                        new XAttribute(XNamespace.Xmlns + "r", OfficeRelationshipsNamespace),
                        new XElement(
                            SpreadsheetNamespace + "sheets",
                            new XElement(
                                SpreadsheetNamespace + "sheet",
                                new XAttribute("name", "Applications"),
                                new XAttribute("sheetId", "1"),
                                new XAttribute(OfficeRelationshipsNamespace + "id", "rId1"))))));

            AddXml(
                archive,
                "xl/_rels/workbook.xml.rels",
                CreateDocument(
                    new XElement(
                        PackageRelationshipsNamespace + "Relationships",
                        new XElement(
                            PackageRelationshipsNamespace + "Relationship",
                            new XAttribute("Id", "rId1"),
                            new XAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"),
                            new XAttribute("Target", "worksheets/sheet1.xml")))));

            var sheetRows = rows.Select((row, rowIndex) =>
                new XElement(
                    SpreadsheetNamespace + "row",
                    new XAttribute("r", rowIndex + 1),
                    row.Select((value, columnIndex) =>
                    {
                        var safeValue = MakeXmlSafe(value?.Trim() ?? string.Empty);

                        return new XElement(
                            SpreadsheetNamespace + "c",
                            new XAttribute("r", CellReference(columnIndex + 1, rowIndex + 1)),
                            new XAttribute("t", "inlineStr"),
                            new XElement(
                                SpreadsheetNamespace + "is",
                                new XElement(
                                    SpreadsheetNamespace + "t",
                                    new XAttribute(XNamespace.Xml + "space", "preserve"),
                                    safeValue)));
                    })));

            AddXml(
                archive,
                "xl/worksheets/sheet1.xml",
                CreateDocument(
                    new XElement(
                        SpreadsheetNamespace + "worksheet",
                        new XElement(SpreadsheetNamespace + "sheetData", sheetRows))));
        }

        return memory.ToArray();
    }

    private static XDocument CreateDocument(XElement root)
    {
        return new XDocument(new XDeclaration("1.0", "UTF-8", "yes"), root);
    }

    private static string EscapeCsv(string? value)
    {
        var safe = value ?? string.Empty;
        var trimmedStart = safe.TrimStart();

        // Prevent spreadsheet formula injection in CSV exports.
        if (trimmedStart.Length > 0 && "=+-@\t\r".Contains(trimmedStart[0]))
        {
            safe = "'" + safe;
        }

        return "\"" + safe.Replace("\"", "\"\"") + "\"";
    }

    private static string CellReference(int column, int row)
    {
        var name = string.Empty;

        while (column > 0)
        {
            var remainder = (column - 1) % 26;
            name = (char)('A' + remainder) + name;
            column = (column - 1) / 26;
        }

        return $"{name}{row}";
    }

    private static string MakeXmlSafe(string value)
    {
        if (value.Length == 0)
        {
            return value;
        }

        var builder = new StringBuilder(value.Length);
        ReadOnlySpan<char> remaining = value.AsSpan();

        while (!remaining.IsEmpty)
        {
            var status = Rune.DecodeFromUtf16(remaining, out var rune, out var charsConsumed);

            if (status != OperationStatus.Done)
            {
                // Replace an unpaired UTF-16 surrogate with the Unicode replacement character.
                builder.Append('\uFFFD');
                remaining = remaining[1..];
                continue;
            }

            var codePoint = rune.Value;
            var isValidXmlCharacter = codePoint is 0x09 or 0x0A or 0x0D
                || (codePoint >= 0x20 && codePoint <= 0xD7FF)
                || (codePoint >= 0xE000 && codePoint <= 0xFFFD)
                || (codePoint >= 0x10000 && codePoint <= 0x10FFFF);

            if (isValidXmlCharacter)
            {
                builder.Append(rune.ToString());
            }

            remaining = remaining[charsConsumed..];
        }

        return builder.ToString();
    }

    private static void AddXml(ZipArchive archive, string path, XDocument document)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        document.Save(writer, SaveOptions.DisableFormatting);
    }
}
