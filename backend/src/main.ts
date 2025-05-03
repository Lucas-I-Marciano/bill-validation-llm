import express, { Request, Response, json } from "express";

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(json());
