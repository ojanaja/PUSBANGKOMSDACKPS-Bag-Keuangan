export async function processImageFile(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;

    const options = {
        maxSizeMB: 1,
        useWebWorker: true,
    };

    try {
        const { default: imageCompression } = await import('browser-image-compression');
        const compressedBlob = await imageCompression(file, options);

        const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const cleanName = originalName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = new Date().getTime();
        const newName = `${timestamp}_${cleanName}.webp`;

        return new File([compressedBlob], newName, {
            type: 'image/webp',
            lastModified: Date.now(),
        });
    } catch (error) {
        console.error("Image compression failed, using original file:", error);
        return file;
    }
}
