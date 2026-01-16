import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsIn } from "class-validator";

export class SaveMessageDto {
    @ApiProperty({
        description: "Message content",
        example: "Can you explain derivatives?",
    })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({
        description: "Message sender",
        example: "user",
        enum: ["user", "assistant", "system"],
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(["user", "assistant", "system"])
    sender: string;
}
