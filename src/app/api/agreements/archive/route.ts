import {requireOwner} from '@/lib/auth/viewer';
import {prisma} from '@/lib/prisma';
import {archiveConfig} from '@/lib/agreements/archive-config';
import {archiveHandlers} from '@/lib/agreements/archive-http';
import {prismaArchiveStore} from '@/lib/agreements/archive-store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const {GET,POST}=archiveHandlers({authenticate:requireOwner,store:prismaArchiveStore(prisma),config:archiveConfig});
