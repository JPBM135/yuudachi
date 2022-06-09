import { ApplicationCommandOptionType } from 'discord-api-types/v10';

export const CheckScamCommand = {
	name: 'checkscam',
	description: 'Check provided content for scam domains',
	options: [
		{
			name: 'content',
			description: 'String to check',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		{
			name: 'hide',
			description: 'Hides the output',
			type: ApplicationCommandOptionType.Boolean,
		},
	],
	default_member_permissions: '0',
} as const;
