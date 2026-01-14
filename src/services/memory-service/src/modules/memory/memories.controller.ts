import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { MemoriesService } from "./application/services/memories.service";
import { SynthesizeMemoriesDto } from "./application/dto/synthesize-memories.dto";

@ApiTags("memories")
@Controller("api/v1/memory")
export class MemoriesController {
    constructor(private readonly memoriesService: MemoriesService) {}

    @Post("synthesize")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Synthesize memories from conversation history using mem0.ai",
    })
    @ApiResponse({
        status: 200,
        description: "Memories synthesized successfully",
        schema: {
            example: {
                success: true,
                message: "Memory synthesis queued"
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: "Chat not found",
    })
    async synthesizeMemories(@Body() dto: SynthesizeMemoriesDto) {
        return this.memoriesService.synthesizeMemories(dto);
    }

  @Get("users/:userID/memories")
  @ApiOperation({ summary: "Get all synthesized memories for a user" })
  @ApiParam({
    name: "userID",
    description: "User identifier (valid test users: user_123, user_789)",
    example: "user_123",
  })
  @ApiResponse({
    status: 200,
    description: "Memories retrieved successfully",
    schema: {
      example: {
        memories: [
          {
            memoryID: "mem_xyz789",
            content: "Student demonstrates understanding of calculus concepts",
            createdAt: "2025-11-20T10:30:00.000Z",
            relatedChats: ["chat_abc123"],
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async getUserMemories(@Param("userID") userID: string) {
    return this.memoriesService.getUserMemories(userID);
  }
}
