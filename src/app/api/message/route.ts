import { db } from "@/db";
import { pinecone } from "@/lib/pinecone";
import { SendMessageValidator } from "@/lib/validators/SendMessageValidator";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
    const body = await req.json();

    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;

    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { fileId, message } = SendMessageValidator.parse(body);

    const file = await db.file.findFirst({
        where: {
            id: fileId,
            userId,
        },
    });
    if (!file) return new Response("Not found", { status: 404 });

    await db.message.create({
        data: {
            text: message,
            isUserMessage: true,
            userId,
            fileId,
        },
    });

    // ✅ GEMINI EMBEDDINGS
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY!,
        modelName: "models/embedding-001",
    });

    const pineconeIndex = pinecone.Index("aviso");

    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace: file.id,
    });

    const results = await vectorStore.similaritySearch(message, 4);

    const prevMessages = await db.message.findMany({
        where: { fileId },
        orderBy: { createdAt: "asc" },
        take: 6,
    });

    const formattedPrevMessages = prevMessages.map((msg) => ({
        role: msg.isUserMessage ? "user" : "assistant",
        content: msg.text,
    }));

    // ✅ GEMINI LLM
    const model = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY!,
        model: "models/gemini-2.0-flash",
        maxOutputTokens: 2048,
        temperature: 0,
    });

    const chatInput = [
        {
            role: "system",
            content:
                "Use the following pieces of context (or previous conversation if needed) to answer the user's question in markdown format.",
        },
        ...formattedPrevMessages,
        {
            role: "user",
            content: `Use the following context and chat history to respond:\n\n---\n\nPREVIOUS:\n${formattedPrevMessages
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n")}\n\n---\n\nCONTEXT:\n${results
                    .map((r) => r.pageContent)
                    .join("\n\n")}\n\nUSER INPUT:\n${message}`,
        },
    ];

    const res = await model.invoke(chatInput);

    // Store assistant reply
    await db.message.create({
        data: {
            text: res.content,
            isUserMessage: false,
            userId,
            fileId,
        },
    });

    return new Response(res.content, {
        status: 200,
    });
};
