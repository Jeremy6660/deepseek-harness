// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BrandImage } from '@deepseek-ai/dsh-client-ui-primitives'

afterEach(cleanup)

describe('BrandImage', () => {
  it('renders the source, alt text, and square dimensions', () => {
    render(<BrandImage src="data:image/png;base64,iVBORw0KGgo=" alt="Publisher mark" size={34} />)
    const image = screen.getByRole('img', { name: 'Publisher mark' }) as HTMLImageElement
    expect(image.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(image.width).toBe(34)
    expect(image.height).toBe(34)
  })

  it('renders at natural size when no size is given and forwards className', () => {
    const { container } = render(<BrandImage src="data:image/png;base64,iVBORw0KGgo=" alt="Mark" className="x" />)
    const image = screen.getByRole('img', { name: 'Mark' }) as HTMLImageElement
    expect(image.hasAttribute('width')).toBe(false)
    expect(image.hasAttribute('height')).toBe(false)
    expect((container.firstElementChild as HTMLElement).classList.contains('x')).toBe(true)
  })
})
