import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { UserService } from "./application/services/user.service";
import { RegisterUserDto } from "./application/dto/register-user.dto";

@ApiTags("users")
@Controller("api/v1/memory/users")
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post("register")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Register a new user (idempotent)",
        description: "Registers a user in the memory system. If the user already exists, returns the existing user.",
    })
    @ApiResponse({
        status: 200,
        description: "User registered successfully",
        schema: {
            example: {
                success: true,
                message: "User registered successfully",
                user: {
                    id: "user_abc123",
                    name: "John Doe",
                    role: "student",
                    createdAt: "2025-11-20T10:00:00.000Z",
                    updatedAt: "2025-11-20T10:00:00.000Z",
                },
            },
        },
    })
    async registerUser(@Body() dto: RegisterUserDto) {
        // Check if user exists first to determine message
        const existingUser = await this.userService.findUserById(dto.userID);
        const isNew = !existingUser;

        const user = await this.userService.registerUser({
            id: dto.userID,
            name: dto.name,
            role: dto.role,
        });

        return {
            success: true,
            message: isNew ? "User registered successfully" : "User already registered",
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            },
        };
    }

    @Get(":userID")
    @ApiOperation({
        summary: "Get user by ID",
    })
    @ApiParam({
        name: "userID",
        description: "User identifier",
        example: "user_abc123",
    })
    @ApiResponse({
        status: 200,
        description: "User retrieved successfully",
        schema: {
            example: {
                id: "user_abc123",
                name: "John Doe",
                role: "student",
                createdAt: "2025-11-20T10:00:00.000Z",
                updatedAt: "2025-11-20T10:00:00.000Z",
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: "User not found",
    })
    async getUser(@Param("userID") userID: string) {
        const user = await this.userService.findUserById(userID);
        if (!user) {
            throw new NotFoundException(`User ${userID} not found`);
        }
        return {
            id: user.id,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
        };
    }
}
