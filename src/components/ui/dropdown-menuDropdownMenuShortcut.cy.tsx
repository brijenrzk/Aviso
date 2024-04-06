import React from 'react'
import { DropdownMenuShortcut } from './dropdown-menu'

describe('<DropdownMenuShortcut />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<DropdownMenuShortcut />)
  })
})