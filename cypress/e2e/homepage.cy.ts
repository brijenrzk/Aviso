describe('The Home Page', () => {
    it('successfully loads', () => {
        cy.visit('/') // change URL to match your dev URL
    })
})


describe("Login", () => {
    it('successfully loads', () => {
        cy.visit('https://avisochat.kinde.com/auth/cx/_:nav&m:login&psid:a2aa3af845d745279f50283a00a0dc8c')

        cy.get('input[type="email"]').type('notanemail')
        cy.get('button').contains('Continue').click()
    })
})