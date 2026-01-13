import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Memory Service (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
                forbidNonWhitelisted: true,
            })
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe("/api/v1/memory/register (POST)", () => {
        it("should register a new user", () => {
            return request(app.getHttpServer())
                .post("/api/v1/memory/register")
                .send({
                    userID: "test_user_001",
                    name: "Test User",
                    role: "student",
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty("success");
                    expect(res.body.success).toBe(true);
                });
        });

        it("should be idempotent - registering same user returns success", () => {
            return request(app.getHttpServer())
                .post("/api/v1/memory/register")
                .send({
                    userID: "test_user_001",
                    name: "Test User",
                    role: "student",
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body.success).toBe(true);
                });
        });

        it("should return 400 for invalid role", () => {
            return request(app.getHttpServer())
                .post("/api/v1/memory/register")
                .send({
                    userID: "test_user_002",
                    name: "Test User",
                    role: "invalid_role",
                })
                .expect(400);
        });
    });

    describe("/api/v1/memory/messages (POST)", () => {
        it("should create new conversation and save message", () => {
            return request(app.getHttpServer())
                .post("/api/v1/memory/messages")
                .send({
                    chatID: null,
                    userID: "test_user_001",
                    content: "Hello, can you help me with calculus?",
                    sender: "user",
                })
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty("success");
                    expect(res.body).toHaveProperty("chatID");
                    expect(res.body).toHaveProperty("messageID");
                    expect(res.body.success).toBe(true);
                });
        });
    });
});
