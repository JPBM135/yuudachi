import { ms } from '@naval-base/ms';
import dayjs from 'dayjs';
import {
	Attachment,
	ButtonStyle,
	Collection,
	CommandInteraction,
	ComponentType,
	Formatters,
	GuildMember,
	TextChannel,
} from 'discord.js';
import i18next from 'i18next';
import type { Redis } from 'ioredis';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import { DATE_FORMAT_LOGFILE } from '../../../../Constants.js';
import { Case, CaseAction, createCase } from '../../../../functions/cases/createCase.js';
import { generateCasePayload } from '../../../../functions/logging/generateCasePayload.js';
import { insertAntiRaidNukeCaseLog } from '../../../../functions/logging/insertAntiRaidNukeCaseLog.js';
import { logger } from '../../../../logger.js';
import { createButton } from '../../../../util/button.js';
import { generateTargetInformation } from '../../../../util/generateTargetInformation.js';
import { createMessageActionRow } from '../../../../util/messageActionRow.js';

interface AntiRaidFileArgs {
	file: Attachment;
	reason?: string | undefined;
	days?: number | undefined;
	hide?: boolean | undefined;
}

async function parseFile(file: Attachment): Promise<Set<string>> {
	const content = await fetch(file.url).then((res) => res.text());

	const ids: string[] | null = content.match(/\d{17,20}/g);

	if (!ids?.length) {
		return new Set();
	}

	return new Set(ids);
}

export async function file(
	interaction: CommandInteraction<'cached'>,
	data: AntiRaidFileArgs,
	logChannel: TextChannel,
	locale: string,
	redis: Redis,
): Promise<void> {
	const reply = await interaction.deferReply({ ephemeral: data.hide ?? true });

	const file = data.file;

	const ids = await parseFile(file);

	if (!ids.size) {
		throw new Error(i18next.t('command.mod.anti_raid_nuke.errors.no_ids', { lng: locale }));
	}

	const { reason, days } = {
		reason: data.reason ?? null,
		days: data.days ?? 1,
	};

	const fetchedMembers = await interaction.guild.members.fetch();
	const members = new Collection<string, GuildMember>();
	const fails = new Set<string>();

	for (const id of ids) {
		const member = fetchedMembers.get(id);
		if (member) {
			members.set(id, member);
		} else {
			fails.add(id);
		}
	}

	if (!members.size) {
		throw new Error(i18next.t('command.mod.anti_raid_nuke.errors.no_hits_file', { lng: locale }));
	}

	const parameterStrings = [
		i18next.t('command.mod.anti_raid_nuke.parameters.heading', { lng: locale }),
		i18next.t('command.mod.anti_raid_nuke.parameters.current_time', {
			lng: locale,
			now: Formatters.time(dayjs().unix(), Formatters.TimestampStyles.ShortDateTime),
		}),
		i18next.t('command.mod.anti_raid_nuke.parameters.file', {
			lng: locale,
			file: Formatters.hyperlink('File uploaded', file.url),
		}),
	];

	const banKey = nanoid();
	const cancelKey = nanoid();

	const banButton = createButton({
		customId: banKey,
		label: i18next.t('command.mod.anti_raid_nuke.buttons.execute', { lng: locale }),
		style: ButtonStyle.Danger,
	});
	const cancelButton = createButton({
		customId: cancelKey,
		label: i18next.t('command.mod.anti_raid_nuke.buttons.cancel', { lng: locale }),
		style: ButtonStyle.Secondary,
	});

	const potentialHits = Buffer.from(members.map((member) => generateTargetInformation(member)).join('\r\n'));
	const potentialHitsDate = dayjs().format(DATE_FORMAT_LOGFILE);

	let creationLower = Number.POSITIVE_INFINITY;
	let creationUpper = Number.NEGATIVE_INFINITY;
	let joinLower = Number.POSITIVE_INFINITY;
	let joinUpper = Number.NEGATIVE_INFINITY;

	for (const member of members.values()) {
		if (member.joinedTimestamp) {
			joinLower = Math.min(member.joinedTimestamp, joinLower);
			joinUpper = Math.max(member.joinedTimestamp, joinUpper);
		}
		creationLower = Math.min(member.user.createdTimestamp, creationLower);
		creationUpper = Math.max(member.user.createdTimestamp, creationUpper);
	}

	const creationrange = ms(creationUpper - creationLower, true);
	const joinrange = ms(joinUpper - joinLower, true);

	await interaction.editReply({
		content: `${i18next.t('command.mod.anti_raid_nuke.pending', {
			members: members.size,
			creationrange,
			joinrange,
			lng: locale,
		})}\n\n${parameterStrings.join('\n')}`,
		files: [{ name: `${potentialHitsDate}-anti-raid-nuke-list.txt`, attachment: potentialHits }],
		components: [createMessageActionRow([cancelButton, banButton])],
	});

	const collectedInteraction = await reply
		.awaitMessageComponent({
			filter: (collected) => collected.user.id === interaction.user.id,
			componentType: ComponentType.Button,
			time: 60000,
		})
		.catch(async () => {
			try {
				await interaction.editReply({
					content: i18next.t('common.errors.timed_out', { lng: locale }),
					components: [],
				});
			} catch (e) {
				const error = e as Error;
				logger.error(error, error.message);
			}
			return undefined;
		});

	if (collectedInteraction?.customId === cancelKey) {
		await collectedInteraction.update({
			content: i18next.t('command.mod.anti_raid_nuke.cancel', {
				lng: locale,
			}),
			components: [],
			attachments: [],
		});
	} else if (collectedInteraction?.customId === banKey) {
		await collectedInteraction.update({
			components: [
				createMessageActionRow([
					{ ...cancelButton, disabled: true },
					{ ...banButton, disabled: true },
				]),
			],
		});

		await redis.setex(`guild:${collectedInteraction.guildId}:anti_raid_nuke`, 15, 'true');
		let idx = 0;
		const promises = [];
		const fatalities: GuildMember[] = [];
		const survivors: GuildMember[] = [];
		for (const member of members.values()) {
			promises.push(
				createCase(
					collectedInteraction.guild,
					generateCasePayload({
						guildId: collectedInteraction.guildId,
						user: collectedInteraction.user,
						args: {
							reason: i18next.t('command.mod.anti_raid_nuke.reason', {
								current: ++idx,
								members: members.size,
								lng: locale,
							}),
							user: {
								member: member,
								user: member.user,
							},
							days: days,
						},
						action: CaseAction.Ban,
						multi: true,
					}),
				)
					.then((case_) => {
						fatalities.push(member);
						return case_;
					})
					.catch(() => {
						survivors.push(member);
					})
					.finally(() => void redis.expire(`guild:${collectedInteraction.guildId}:anti_raid_nuke`, 15)),
			);
		}

		const resolvedCases = await Promise.all(promises);
		const cases = resolvedCases.filter((resolvedCase) => resolvedCase) as Case[];
		await redis.expire(`guild:${collectedInteraction.guildId}:anti_raid_nuke`, 5);

		await insertAntiRaidNukeCaseLog(
			collectedInteraction.guild,
			collectedInteraction.user,
			logChannel,
			cases,
			reason ?? i18next.t('command.mod.anti_raid_nuke.success', { lng: locale, members: fatalities.length }),
		);

		const membersHit = Buffer.from(fatalities.map((member) => member.id).join('\r\n'));
		const membersHitDate = dayjs().format(DATE_FORMAT_LOGFILE);

		await collectedInteraction.editReply({
			content: i18next.t('command.mod.anti_raid_nuke.success', {
				members: fatalities.length,
				lng: locale,
			}),
			files: [{ name: `${membersHitDate}-anti-raid-nuke-report.txt`, attachment: membersHit }],
			components: [],
		});
	}
}
