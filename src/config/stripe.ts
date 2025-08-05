export const PLANS = [
    {
        name: 'Free',
        slug: 'free',
        quota: 10,
        pagesPerPdf: 10,
        price: {
            amount: 0,
            priceIds: {
                test: '',
                production: '',
            },
        },
    },
    {
        name: 'Pro',
        slug: 'pro',
        quota: 50,
        pagesPerPdf: 25,
        price: {
            amount: 150,
            priceIds: {
                test: 'price_1Org0003uK8H1jur1bVpoQRi',
                production: '',
            },
        },
    },
]