import { type ClassValue, clsx } from "clsx"
import { Metadata } from "next"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  if (typeof window !== 'undefined') return path
  // if (process.env.VERCEL_URL) {
  //   return `https://${process.env.VERCEL_URL}${path}`
  // }
  return `http://localhost:${process.env.PORT ?? 3000
    }${path}`
}

export function constructMetadata({
  title = "Aviso - the SaaS for students",
  description = "Aviso is a software to make chatting to your PDF and Audio files easy.",
  noIndex = false
}: {
  title?: string
  description?: string
  noIndex?: boolean
} = {}): Metadata {
  return {
    title,
    description,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false
      }
    })
  }
}