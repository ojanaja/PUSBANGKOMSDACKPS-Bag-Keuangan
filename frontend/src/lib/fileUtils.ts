import imageCompression from 'browser-image-compression';

export async function processImageFile(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;

    const options = {
        useWebWorker: true,
    };

    try {
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
