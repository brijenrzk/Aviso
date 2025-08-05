import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/db'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic' // Required for Vercel
export const preferredRegion = 'home'  // Optional: stick to primary region

export async function POST(req: NextRequest) {
    const sig = req.headers.get('stripe-signature') ?? ''
    const text = await req.text()

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            text,
            sig,
            process.env.STRIPE_WEBHOOK_SIGNING_SECRET!
        )
    } catch (err) {
        console.error(
            '⚠️ Webhook signature verification failed:',
            err instanceof Error ? err.message : err
        )
        return new Response('Invalid signature', { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (event.type === 'checkout.session.completed') {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        )

        await db.user.update({
            where: { id: session.metadata?.userId },
            data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                stripePriceId: subscription.items.data[0]?.price.id,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                ),
            },
        })
    }

    return new Response('Webhook received', { status: 200 })
}
