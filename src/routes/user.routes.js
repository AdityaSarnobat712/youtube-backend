import { Router } from "express";
import { changecurrentpassword,
    getcurrentuser, 
    getuserchannelprofile, 
    getWatchHistory, 
    loginuser,
    logoutUser, 
    registeruser, 
    updateAccountDetails, 
    updateuseravatar, 
    updateusercoverimage 
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { refreshAccessToken } from "../controllers/user.controller.js";


const router = Router()
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registeruser)

router.route("/login").post(loginuser)

router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("changepassword").post(verifyJWT, changecurrentpassword)
router.route("/currentuser").post(verifyJWT,getcurrentuser)
router.route("/Updateaccountdetails").patch(verifyJWT,updateAccountDetails)

router.route("/avatar").patch(verifyJWT,upload.single("avatar"), updateuseravatar)
router.route("/cover-image").patch(verifyJWT,upload.single("coverImage"), updateusercoverimage)

router.route("/c/:username").get(verifyJWT,getuserchannelprofile)
router.route("/history").get(verifyJWT,getWatchHistory)
export default router;
