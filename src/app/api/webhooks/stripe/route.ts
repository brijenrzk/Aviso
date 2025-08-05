import { db } from '@/db'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'

// Required for Stripe to verify the raw body signature
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    // Read raw body manually for Stripe signature verification
    const rawBody = await req.text()
    const signature = headers().get('stripe-signature') ?? ''

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SIGNING_SECRET || ''
        )
    } catch (err) {
        const message =
            err instanceof Error ? err.message : 'Unknown Error'
        console.error('⚠️ Stripe webhook signature error:', message)

        return new Response(`Webhook Error: ${message}`, {
            status: 400,
        })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (!session?.metadata?.userId) {
        return new Response(null, { status: 200 })
    }

    try {
        if (event.type === 'checkout.session.completed') {
            console.log('✅ Checkout session completed')

            const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
            )

            await db.user.update({
                where: { id: session.metadata.userId },
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

        if (event.type === 'invoice.payment_succeeded') {
            console.log('✅ Invoice payment succeeded')

            const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
            )

            await db.user.update({
                where: {
                    stripeSubscriptionId: subscription.id,
                },
                data: {
                    stripePriceId: subscription.items.data[0]?.price.id,
                    stripeCurrentPeriodEnd: new Date(
                        subscription.current_period_end * 1000
                    ),
                },
            })
        }

        return new Response(null, { status: 200 })
    } catch (err) {
        console.error('❌ Error processing Stripe webhook:', err)
        return new Response('Internal error', { status: 500 })
    }
}
