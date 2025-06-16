import { ApiError } from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js"
import { uploadoncloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"

const registeruser = asyncHandler( async (req,res ) => {
    //get user details from frontend
    //validation of user details
    const {fullName,email,username,password} = req.body
    console.log("email: ",email);
    
    if(
        [fullName,email,username,password].some((field) => field?.trim() === "")
    )
    {
        throw new ApiError(400,"All fields are required")
    }

    //check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    console.log(req.files);
    
    //check for images, check for avatar
    const avatarlocalpath =  req.files?.avatar[0]?.path;
    const coverImagelocalpath = req.files?.coverImage[0]?.path;

    // let coverImagelocalpath;
    // if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0)
    // {
    //     coverImagelocalpath =  req.files.coverimage[0].path
    // }

    if(!avatarlocalpath)
    {
        throw new ApiError(400,"Avatar is required")
    }

    // upload them to cloudinary , avatar
    const avatar = await uploadoncloudinary(avatarlocalpath)
    const coverimage = await uploadoncloudinary(coverImagelocalpath)

    if(!avatar)
    {
        throw new ApiError(400,"Avatar file is required")
    }

    //create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverimage:coverimage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    //check for user creation 
    if(!createdUser)
    {
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    //return response
    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered Successfully")
    )
})

export {registeruser}