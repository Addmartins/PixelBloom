import { describe, expect, it } from 'vitest'
import { validateClinicLogo } from '../../src/features/operations/clinic-logo'

const png = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]
const jpeg = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]
const webp = [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]

describe('validação do logotipo da clínica', () => {
  it.each([
    { type: 'image/png', extension: 'png', header: png },
    { type: 'image/jpeg', extension: 'jpeg', header: jpeg },
    { type: 'image/webp', extension: 'webp', header: webp },
  ])('reconhece $type pelo MIME e pela assinatura', async ({ type, extension, header }) => {
    const file = new File([Uint8Array.from(header)], 'logo', { type })
    await expect(validateClinicLogo(file)).resolves.toEqual({ extension, contentType: type })
  })

  it('rejeita MIME divergente e conteúdo que simula o MIME de imagem', async () => {
    await expect(validateClinicLogo(new File([Uint8Array.from(png)], 'logo.jpg', { type: 'image/jpeg' }))).resolves.toBeNull()
    await expect(validateClinicLogo(new File(['<script>fictício</script>'], 'logo.png', { type: 'image/png' }))).resolves.toBeNull()
  })

  it('rejeita arquivo acima de 2 MiB mesmo com assinatura compatível', async () => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1)
    oversized.set(png)
    await expect(validateClinicLogo(new File([oversized], 'logo.png', { type: 'image/png' }))).resolves.toBeNull()
  })
})
