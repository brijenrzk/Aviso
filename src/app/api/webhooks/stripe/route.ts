import { db } from '@/db';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

// Read raw body from ReadableStream
async function getRawBody(readable: ReadableStream<Uint8Array> | null): Promise<Buffer> {
    if (!readable) throw new Error('No readable stream');
    const reader = readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }

    return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
    let event: Stripe.Event;
    const sig = headers().get('stripe-signature') ?? '';

    let rawBody: Buffer;
    try {
        rawBody = await getRawBody(req.body);
    } catch (err) {
        return new Response('Unable to read body', { status: 400 });
    }

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SIGNING_SECRET || ''
        );
    } catch (err) {
        console.error('❌ Webhook signature verification failed.', err);
        return new Response(
            `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            { status: 400 }
        );
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (!session?.metadata?.userId) {
        return new Response(null, { status: 200 });
    }

    if (event.type === 'checkout.session.completed') {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        );

        await db.user.update({
            where: {
                id: session.metadata.userId,
            },
            data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                stripePriceId: subscription.items.data[0]?.price.id,
                stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
        });
    }

    if (event.type === 'invoice.payment_succeeded') {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        );

        await db.user.update({
            where: {
                stripeSubscriptionId: subscription.id,
            },
            data: {
                stripePriceId: subscription.items.data[0]?.price.id,
                stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
        });
    }

    return new Response(null, { status: 200 });
}
