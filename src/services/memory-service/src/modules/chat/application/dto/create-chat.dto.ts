import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateChatDto {
    @ApiProperty({
        description: "User ID who owns the chat",
        example: "user_abc123",
    })
    @IsString()
    @IsNotEmpty()
    userID: string;

    @ApiPropertyOptional({
        description: "Chat title",
        example: "Calculus Study Session",
    })
    @IsOptional()
    @IsString()
    title?: string;
}
