import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { pinecone } from "@/lib/pinecone";
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { getUserSubscriptionPlan } from "@/lib/stripe";
import { PLANS } from "@/config/stripe";
import { string } from "zod";

const f = createUploadthing();

const middleware = async () => {
    const { getUser } = getKindeServerSession()
    const user = await getUser()

    if (!user || !user.id) throw new Error("Unauthorized")

    const subscriptionPlan = await getUserSubscriptionPlan()
    return { subscriptionPlan, userId: user.id };
}

const onUploadComplete = async ({ metadata, file }:
    {
        metadata: Awaited<ReturnType<typeof middleware>>
        file: {
            key: string
            name: string
            url: string
        }
    }
) => {
    console.log(file)
    const isFileExist = await db.file.findFirst({
        where: {
            key: file.key
        },
    })

    if (isFileExist) return

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

        const { subscriptionPlan } = metadata
        const { isSubscribed } = subscriptionPlan

        const isProExceeded = pageAmt > PLANS.find((plan) => plan.name === "Pro")!.pagesPerPdf
        const isFreeExceeded = pageAmt > PLANS.find((plan) => plan.name === "Free")!.pagesPerPdf
        if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
            await db.file.update({
                data: {
                    UploadStatus: "FAILED"
                },
                where: {
                    id: createdFile.id
                }
            })
        }

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

}


export const ourFileRouter = {
    freePlanUploader: f({ pdf: { maxFileSize: "4MB" }, audio: { maxFileSize: "4MB" } })
        .middleware(middleware)
        .onUploadComplete(onUploadComplete),
    proPlanUploader: f({ pdf: { maxFileSize: "16MB" }, audio: { maxFileSize: "16MB" } })
        .middleware(middleware)
        .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;