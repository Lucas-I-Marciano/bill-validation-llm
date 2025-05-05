import {
  IsString,
  IsEnum,
  IsISO8601, // ISO 8601 (ex: "2025-05-04T10:09:50.000Z")
  IsNotEmpty,
  IsBase64,
} from "class-validator";
import { BillType } from "../interfaces/BillType.enum.js";

export class UploadBillDto {
  @IsBase64()
  @IsNotEmpty()
  image!: string; // Imagem em base64

  @IsString()
  @IsNotEmpty()
  customer_code!: string;

  @IsISO8601()
  @IsNotEmpty()
  measure_datetime!: string;

  @IsEnum(BillType)
  @IsNotEmpty()
  measure_type!: BillType;
}
