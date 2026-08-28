const escapeCsvValue = (value: unknown) => {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvValue).join(",")
  );
  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
