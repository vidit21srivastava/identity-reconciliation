import { PrismaClient } from '.prisma/client';
import type { Contact } from '.prisma/client';

const prisma = new PrismaClient();

export interface IdentifyRequest {
    email?: string;
    phoneNumber?: string;
}

export interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

export class IdentityService {
    async identify(request: IdentifyRequest): Promise<IdentifyResponse> {
        const { email, phoneNumber } = request;

        // Find existing contacts with matching email or phone
        const existingContacts = await this.findExistingContacts(email, phoneNumber);

        if (existingContacts.length === 0) {
            // No existing contacts, create new primary contact
            const newContact = await this.createPrimaryContact(email, phoneNumber);
            return this.formatResponse([newContact]);
        }

        // Group contacts by their primary contact
        const contactGroups = await this.groupContactsByPrimary(existingContacts);

        if (contactGroups.length === 1) {
            // All contacts belong to same group
            const allContacts = contactGroups[0];

            // Check if we need to create a new secondary contact
            const needsNewContact = this.needsNewSecondaryContact(allContacts, email, phoneNumber);

            if (needsNewContact) {
                const primaryContact = allContacts.find(c => c.linkPrecedence === 'primary')!;
                const newSecondary = await this.createSecondaryContact(email, phoneNumber, primaryContact.id);
                allContacts.push(newSecondary);
            }

            return this.formatResponse(allContacts);
        }

        // Multiple groups found - need to merge them
        const mergedContacts = await this.mergeContactGroups(contactGroups, email, phoneNumber);
        return this.formatResponse(mergedContacts);
    }

    private async findExistingContacts(email?: string, phoneNumber?: string): Promise<Contact[]> {
        const whereConditions = [];

        if (email) {
            whereConditions.push({ email });
        }

        if (phoneNumber) {
            whereConditions.push({ phoneNumber });
        }

        if (whereConditions.length === 0) {
            return [];
        }

        return await prisma.contact.findMany({
            where: {
                OR: whereConditions,
                deletedAt: null
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    private async groupContactsByPrimary(contacts: Contact[]): Promise<Contact[][]> {
        const groups: { [primaryId: number]: Contact[] } = {};

        for (const contact of contacts) {
            const primaryId = contact.linkPrecedence === 'primary' ? contact.id : contact.linkedId!;

            if (!groups[primaryId]) {
                groups[primaryId] = [];
            }
            groups[primaryId].push(contact);
        }

        // Fetch complete groups (including primary contacts if not already included)
        const completeGroups: Contact[][] = [];

        for (const [primaryIdStr, groupContacts] of Object.entries(groups)) {
            const primaryId = parseInt(primaryIdStr);

            // Get all contacts in this group
            const allGroupContacts = await prisma.contact.findMany({
                where: {
                    OR: [
                        { id: primaryId },
                        { linkedId: primaryId }
                    ],
                    deletedAt: null
                },
                orderBy: { createdAt: 'asc' }
            });

            completeGroups.push(allGroupContacts);
        }

        return completeGroups;
    }

    private needsNewSecondaryContact(existingContacts: Contact[], email?: string, phoneNumber?: string): boolean {
        const hasEmail = email && existingContacts.some(c => c.email === email);
        const hasPhone = phoneNumber && existingContacts.some(c => c.phoneNumber === phoneNumber);

        // Create new contact if we have new information
        if (email && !hasEmail) return true;
        if (phoneNumber && !hasPhone) return true;

        return false;
    }

    private async createPrimaryContact(email?: string, phoneNumber?: string): Promise<Contact> {
        return await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: 'primary'
            }
        });
    }

    private async createSecondaryContact(email?: string, phoneNumber?: string, linkedId?: number): Promise<Contact> {
        return await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId,
                linkPrecedence: 'secondary'
            }
        });
    }

    private async mergeContactGroups(groups: Contact[][], email?: string, phoneNumber?: string): Promise<Contact[]> {
        // Find the oldest primary contact
        const oldestPrimary = groups
            .map(group => group.find(c => c.linkPrecedence === 'primary')!)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        // Update all other primary contacts to secondary
        for (const group of groups) {
            const primaryContact = group.find(c => c.linkPrecedence === 'primary')!;

            if (primaryContact.id !== oldestPrimary.id) {
                await prisma.contact.update({
                    where: { id: primaryContact.id },
                    data: {
                        linkedId: oldestPrimary.id,
                        linkPrecedence: 'secondary',
                        updatedAt: new Date()
                    }
                });
            }
        }

        // Update all secondary contacts to point to the oldest primary
        for (const group of groups) {
            const secondaryContacts = group.filter(c => c.linkPrecedence === 'secondary');

            for (const secondary of secondaryContacts) {
                if (secondary.linkedId !== oldestPrimary.id) {
                    await prisma.contact.update({
                        where: { id: secondary.id },
                        data: {
                            linkedId: oldestPrimary.id,
                            updatedAt: new Date()
                        }
                    });
                }
            }
        }

        // Check if we need to create a new secondary contact
        const allContacts = groups.flat();
        const needsNewContact = this.needsNewSecondaryContact(allContacts, email, phoneNumber);

        if (needsNewContact) {
            const newSecondary = await this.createSecondaryContact(email, phoneNumber, oldestPrimary.id);
            allContacts.push(newSecondary);
        }

        // Fetch the updated contact group
        return await prisma.contact.findMany({
            where: {
                OR: [
                    { id: oldestPrimary.id },
                    { linkedId: oldestPrimary.id }
                ],
                deletedAt: null
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    private formatResponse(contacts: Contact[]): IdentifyResponse {
        const primary = contacts.find(c => c.linkPrecedence === 'primary')!;
        const secondaries = contacts.filter(c => c.linkPrecedence === 'secondary');

        const emails = [
            ...(primary.email ? [primary.email] : []),
            ...secondaries.map(c => c.email).filter(Boolean) as string[]
        ];

        const phoneNumbers = [
            ...(primary.phoneNumber ? [primary.phoneNumber] : []),
            ...secondaries.map(c => c.phoneNumber).filter(Boolean) as string[]
        ];

        // Remove duplicates while preserving order
        const uniqueEmails = [...new Set(emails)];
        const uniquePhoneNumbers = [...new Set(phoneNumbers)];

        return {
            contact: {
                primaryContactId: primary.id,
                emails: uniqueEmails,
                phoneNumbers: uniquePhoneNumbers,
                secondaryContactIds: secondaries.map(c => c.id)
            }
        };
    }
}