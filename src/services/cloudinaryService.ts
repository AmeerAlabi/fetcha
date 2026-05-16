import { v2 as cloudinary } from 'cloudinary';

export const uploadBase64Image = async (dataUri: string, folder: string): Promise<string> => {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
};