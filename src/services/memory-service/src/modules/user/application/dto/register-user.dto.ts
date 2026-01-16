import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsIn } from "class-validator";

export class RegisterUserDto {
    @ApiProperty({
        description: "Unique user identifier",
        example: "user_abc123",
    })
    @IsString()
    @IsNotEmpty()
    userID: string;

    @ApiProperty({
        description: "User display name",
        example: "John Doe",
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: "User role",
        example: "student",
        enum: ["student", "teacher", "admin"],
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(["student", "teacher", "admin"])
    role: string;
}
