import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

const verifyJWT = asyncHandler(async(req,res, next) => { // here response is not used in some codes it is replaced by "_"
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if(!token)
        {
            throw new ApiError(401,"Unauthorized access")
        }
    
        const decoded_token = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decoded_token?._id).select("-password -refreshToken")
        if(!user)
        {
            throw new ApiError(401,"Invalid Access token")
        }
    
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid access token")
    }
})

export {verifyJWT}