const maxLogoBytes = 2 * 1024 * 1024
export const clinicLogoBucket = 'organization-logos'
export const logoContentTypes: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

export async function validateClinicLogo(file: File): Promise<{ extension: string; contentType: string } | null> {
  if (file.size < 12 || file.size > maxLogoBytes) return null
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const matches = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[index + offset] === byte)
  const extension = matches([137, 80, 78, 71, 13, 10, 26, 10])
    ? 'png'
    : matches([255, 216, 255])
      ? 'jpeg'
      : matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8)
        ? 'webp'
        : null
  if (!extension || file.type !== logoContentTypes[extension]) return null
  return { extension, contentType: logoContentTypes[extension] }
}
