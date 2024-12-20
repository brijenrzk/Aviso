"use client"

import { useState } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Button } from "./ui/button";
import Dropzone from 'react-dropzone';
import { Cloud, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
import { useUploadThing } from "@/lib/uploadthing";
import { useToast } from "./ui/use-toast";
import { trpc } from "@/app/_trpc/client";
import { useRouter } from "next/navigation";
import { PDFDocument } from 'pdf-lib';




const UploadDropzone = ({ isSubscribed }: { isSubscribed: boolean }) => {

    const router = useRouter()

    const [isUploading, setIsUploading] = useState<boolean>(false)
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [formData, setFormData] = useState<FormData | null>(null);
    const [output, setOutput] = useState<string>("");
    const [err, SetErr] = useState(false);


    const doStuff = async (file: any) => {
        const dataa = new FormData();
        dataa.append("file", file);
        dataa.append("model", "whisper-1");
        dataa.append("language", "en");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            headers: {
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
            },
            method: "POST",
            body: dataa,
        });

        const data = await res.json();

        setOutput(data.text);

        return data.text

    };

    const { startUpload } = useUploadThing(
        isSubscribed ? "proPlanUploader" : "freePlanUploader",
        {
            onBeforeUploadBegin: async (files: any) => {
                const processedFiles = await Promise.all(files.map(async (file: any) => {
                    console.log("I am checking files ", file.path);

                    if (file.type === 'application/pdf') {
                        console.log('It is a validated PDF file!');
                        return file
                    } else {
                        const textContent = await doStuff(file);
                        const pdfDoc: any = await PDFDocument.create();
                        const page = pdfDoc.addPage();
                        const { width, height } = page.getSize();
                        const fontSize = 12;
                        const textX = 50;
                        const textY = height - 50;
                        page.drawText(textContent, { x: textX, y: textY, size: fontSize });
                        const pdfBytes = await pdfDoc.save();
                        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                        const pdfFile = new File([pdfBlob], `${file.name}.pdf`, { type: 'application/pdf' }) as any;
                        return pdfFile;
                    }
                }));

                return processedFiles;
            },
        }
    )
    const { mutate: startPolling } = trpc.getFile.useMutation({
        onSuccess: (file) => {
            router.push(`/dashboard/${file.id}`)
        },
        retry: true,
        retryDelay: 500
    })

    const { toast } = useToast()

    const startSimulatedProgress = () => {
        setUploadProgress(0)
        const interval = setInterval(() => {
            setUploadProgress((prevProgress) => {
                if (prevProgress >= 95) {
                    clearInterval(interval)
                    return prevProgress
                }
                return prevProgress + 5
            })
        }, 500)
        return interval
    }


    return <Dropzone multiple={false} onDrop={async (acceptedFile) => {
        setIsUploading(true)

        const progressInterval = startSimulatedProgress()

        const res = await startUpload(acceptedFile)

        if (!res) {
            SetErr(true)
            setIsUploading(false)
            return toast({
                title: "Something went wrong",
                description: "Max file size allowed is 4mb",
                variant: "destructive"
            })
        }

        const [fileResponse] = res
        const key = fileResponse?.key

        if (!key) {
            return toast({
                title: "Something went wrong",
                description: "Please try again later",
                variant: "destructive"
            })
        }




        clearInterval(progressInterval)
        setUploadProgress(100)

        startPolling({ key })
    }}>
        {({ getRootProps, getInputProps, acceptedFiles }) => (
            <div {...getRootProps()} className="border h-64 m-4 border-dashed border-gray-300 rounded-lg">
                <div className="flex items-center justify-center h-full w-full">
                    <label htmlFor="dropzone-file"
                        className="flex flex-col items-center justify-center w-full h-full rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Cloud className="h-6 w-6 text-zinc-500 mb-2" />
                            <p className="mb-2 text-sm text-zinc-700">
                                <span className="font-semibold">
                                    Click to upload
                                </span>
                                or drag and drop
                            </p>
                            <p className="tex-xs text-zinc-500">PDF or Audio File (up to {isSubscribed ? "16" : "4"}MB & {isSubscribed ? "25" : "5"} pages)</p>
                        </div>

                        {acceptedFiles && acceptedFiles[0] ? (
                            <div className="max-w-xs bg-white flex items-center rounded-md overflow-hidden outline outline-[1px] outline-zinc-200 divide-x divide-zinc-200">
                                <div className="px-3 py-2 h-full grip place-items-center">
                                    {/* <File className="h-4 w-4 text-blie-500" /> */}
                                </div>
                                <div className="px-3 py-2 h-full text0-sm truncate">
                                    {acceptedFiles[0].name}
                                </div>
                            </div>
                        ) : null}

                        {isUploading ? (
                            <div className="w-full mt-4 max-w-xs mx-auto">
                                <Progress

                                    indicatorColor={
                                        err ?
                                            'bg-red-500'
                                            :
                                            uploadProgress === 100 ? 'bg-green-500' : ''
                                    }
                                    value={uploadProgress} className="h-1 w-full bg-zinc-200" />
                                {uploadProgress === 100 ? (
                                    <div className="flex gap-1 items-center justify-center text-sm text-zinc-700 text-center pt-2">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Redirecting...
                                    </div>
                                ) : null}
                            </div>

                        ) : null}
                        <input
                            {...getInputProps()}
                            type="file" id="dropzone-file" className="hidden" />
                    </label>
                </div>
            </div>
        )}
    </Dropzone>
}


const UploadButton = ({ isSubscribed }: { isSubscribed: boolean }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false)

    return (
        <Dialog open={isOpen} onOpenChange={(v) => {
            if (!v) {
                setIsOpen(v)
            }
        }}>
            <DialogTrigger onClick={() => setIsOpen(true)} asChild>
                <Button>Upload PDF</Button>
            </DialogTrigger>

            <DialogContent>
                <UploadDropzone isSubscribed={isSubscribed} />
            </DialogContent>
        </Dialog>
    )
}

export default UploadButton;