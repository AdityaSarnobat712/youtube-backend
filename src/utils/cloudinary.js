import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadoncloudinary = async (localfilepath) => {
    try{
        if(!localfilepath) return null
        //upload file on cloudinary
        const response = await cloudinary.uploader.upload(localfilepath,{
            resource_type: "auto"
        })
        //file has been uploaded
        //console.log("file is uploaded on cloudinary", response.url)
        if(fs.existsSync(localfilepath))
        {
            fs.unlinkSync(localfilepath)
        }
        return response;
    }catch(error){
        fs.unlinkSync(localfilepath) // remove the locally saved temporary file as the upload operation got failed
        return null
    }
}

export {uploadoncloudinary}