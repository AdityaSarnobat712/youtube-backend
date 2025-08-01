import { ApiError } from "../utils/ApiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js"
import { uploadoncloudinary } from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false}) // the parameter is used to skip password validation and save the user directly after refreshtoken is saved in database and user has logged in 

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token ")
    }
}

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

const loginuser = asyncHandler(async (req,res) => {
    //Get data from req body
    const {email,username,password} = req.body
    //username or email
    if(!username && !email)
    {
        throw new ApiError(400,"username or email is required")
    }
    //find the user
    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if(!user)
    {
        throw new ApiError(404,"User does not exist")
    }

    //password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid)
    {
        throw new ApiError(401,"Password is incorrect")
    }

    //generate access and refresh token
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send token through cookies
    const loggedInUser = await User.findById(user._id).select("-password-refreshToken")

    const options = {
        httpOnly: true, // when this field is set true the cookies can be modified only from server and not from frontend
        secure:true
    }

    return res.
    status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    //The accessToken and refreshToken are already sent through cookies still explicitly we are sending them through json response because in some cases user want to save both the tokens from his side
    .json(
        new ApiResponse(200,{
            user: loggedInUser,accessToken,refreshToken
        },
        "User Logged in successfully"
    )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    //Find user
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{ // this set operator comes from mongodb helps in updating the properties of objects
                refreshToken:1
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly: true, // when this field is set true the cookies can be modified only from server and not from frontend
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged out"))
})

const refreshAccessToken = asyncHandler(async(req,res) => {
    const incomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingrefreshToken)
    {
        throw new ApiError(401,"Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingrefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
        if(!user)
        {
            throw new ApiError(401,"Invalid Refresh token")
        }
    
        if(incomingrefreshToken !== user?.refreshToken)
        {
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true, // when this field is set true the cookies can be modified only from server and not from frontend
            secure:true
        }
    
        const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh Token")
    }
})

const changecurrentpassword = asyncHandler(async(req,res) => {
    const {oldpassword,newpassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldpassword)

    if(!isPasswordCorrect)
    {
        throw new ApiError(400,"Invalid old Password")
    }

    user.password = newpassword
    await user.save({validateBeforeSave: false})
    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getcurrentuser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(200,req.user,"Current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName,email} = req.body

    if(!fullName || !email)
    {
        throw new ApiError(400,"All fields are required")
    }
    
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateuseravatar = asyncHandler(async(req,res) => {
    const avatarlocalpath = req.file?.path

    if(!avatarlocalpath)
    {
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadoncloudinary(avatarlocalpath)
    if(!avatar.url)
    {
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,"Avatar image updated successfully")
    )
})

const updateusercoverimage = asyncHandler(async(req,res) => {
    const coverImagelocalpath = req.file?.path

    if(!coverImagelocalpath)
    {
        throw new ApiError(400,"Cover image file is missing")
    }

    const coverimage = await uploadoncloudinary(coverImagelocalpath)

    if(!coverimage.url)
    {
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverimage:coverimage.url
            }
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,"cover image updated successfully")
    )
})

const getuserchannelprofile =  asyncHandler(async(req,res) => {
    const {username} = req.params
    if(!username?.trim())
    {
        throw new ApiError(400,"username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        { 
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscriberscount:{
                    $size: "$subscribers"
                },
                channelsSubscribedTocount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $condition:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false,
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscriberscount:1,
                channelsSubscribedTocount:1,
                isSubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    if(!channel?.length)
    {
        throw new ApiError(404,"Channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res) =>{
    const user = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetched successfully"
    )
    ) 
})


export {registeruser,
    loginuser,
    logoutUser,
    refreshAccessToken,
    changecurrentpassword,
    getcurrentuser,
    updateAccountDetails,
    updateuseravatar,
    updateusercoverimage,
    getuserchannelprofile,
    getWatchHistory
} 