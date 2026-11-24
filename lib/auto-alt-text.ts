export function generateAltText(
  mediaTitle: string | undefined,
  artistName: string | undefined,
  eventTitle: string | undefined,
  defaultText: string = "",
): string {
  const parts: string[] = [];

  if (mediaTitle?.trim()) {
    parts.push(mediaTitle.trim());
  }

  if (artistName?.trim()) {
    parts.push(`artista: ${artistName.trim()}`);
  }

  if (eventTitle?.trim()) {
    parts.push(`evento: ${eventTitle.trim()}`);
  }

  if (parts.length === 0) {
    return defaultText;
  }

  return parts.join(", ");
}
