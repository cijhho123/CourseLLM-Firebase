import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class SynthesizeMemoriesDto {
    @ApiProperty({
        description: "Conversation ID to analyze",
        example: "chat_xyz789",
    })
    @IsString()
    @IsNotEmpty()
    chatID: string;

    @ApiPropertyOptional({
        description: "Focus area for memory extraction",
        example: "learning preferences and knowledge gaps",
    })
    @IsOptional()
    @IsString()
    query?: string;
}
