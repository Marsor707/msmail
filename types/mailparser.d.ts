declare module 'mailparser' {
  export interface ParsedMailAddress {
    name?: string
    address?: string
  }

  export interface ParsedMailAddressGroup {
    value?: ParsedMailAddress[]
  }

  export interface ParsedMailAttachment {
    filename?: string
  }

  export interface ParsedMail {
    subject?: string
    html?: string | false
    text?: string
    messageId?: string
    date?: Date | null
    from?: ParsedMailAddressGroup
    to?: ParsedMailAddressGroup
    cc?: ParsedMailAddressGroup
    attachments?: ParsedMailAttachment[]
  }

  export function simpleParser(input: Buffer | NodeJS.ReadableStream | string): Promise<ParsedMail>
}
