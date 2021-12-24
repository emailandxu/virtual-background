export type BackgroundConfig = {
  type: 'none' | 'blur' | 'image'
  url?: string
}

export const backgroundImageUrls = [
  "transparent.png",
  'architecture-5082700_1280.jpg',
  'porch-691330_1280.jpg',
  'saxon-switzerland-539418_1280.jpg',
  'shibuyasky-4768679_1280.jpg'
].map((imageName) => `${process.env.PUBLIC_URL}/backgrounds/${imageName}`)
