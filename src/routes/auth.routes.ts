import { Router } from "express";
import { register, login, verify } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify", verify);

export default router;
