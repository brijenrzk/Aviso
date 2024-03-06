import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { pinecone } from "@/lib/pinecone";
import { PineconeStore } from 'langchain/vectorstores/pinecone';

const f = createUploadthing();



export const ourFileRouter = {
    pdfUploader: f({ pdf: { maxFileSize: "4MB" }, audio: { maxFileSize: "4MB" } })
        .middleware(async ({ req }) => {
            const { getUser } = getKindeServerSession()
            const user = await getUser()

            if (!user || !user.id) throw new Error("Unauthorized")


            return { userId: user.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log(file)
            const createdFile = await db.file.create({
                data: {
                    key: file.key,
                    name: file.name,
                    userId: metadata.userId,
                    url: `https://utfs.io/f/${file.key}`,
                    UploadStatus: "PROCESSING"
                }
            })


            try {
                const response = await fetch(`https://utfs.io/f/${file.key}`)

                //i need to check here for audio file
                const blob = await response.blob()
                //alternately i can convert audio to pdf here 
                //use jsPDF
                //const doc = new jsPDF("p", "pt", "a4", false);
                const loader = new PDFLoader(blob)

                //use https://js.langchain.com/docs/integrations/document_loaders/file_loaders/openai_whisper_audio

                //if audio file 

                //i need this
                const pageLevelDocs = await loader.load()
                const pageAmt = pageLevelDocs.length

                const pineconeIndex = pinecone.Index("aviso")
                const embeddings = new OpenAIEmbeddings({
                    openAIApiKey: process.env.openAIApiKey,
                })
                await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
                    pineconeIndex,
                    namespace: createdFile.id
                })

                await db.file.update({
                    data: {
                        UploadStatus: "SUCCESS"
                    },
                    where: {
                        id: createdFile.id
                    }

                })

            } catch (err) {
                await db.file.update({
                    data: {
                        UploadStatus: "FAILED"
                    },
                    where: {
                        id: createdFile.id
                    }
                })
            }


        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;