import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';

export const appRouter = router({
    authCallback: publicProcedure.query(async () => {
        const { getUser } = getKindeServerSession()
        const user: any = await getUser()


        if (!user.id || !user.email) throw new TRPCError({ code: 'UNAUTHORIZED' })
        const dbUser = await db.user.findFirst({
            where: {
                id: user.id
            }
        })
        console.log("from user", dbUser)

        if (!dbUser) {
            await db.user.create({
                data: {
                    id: user.id,
                    email: user.email
                }

            })
        }
        return { success: true }

    }),
    getUserFiles: privateProcedure.query(async ({ ctx }) => {
        const { userId } = ctx
        console.log("userrrr +", userId)
        return await db.file.findMany({
            where: {
                userId
            }
        })
    }),
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;