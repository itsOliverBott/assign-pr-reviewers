import * as core from '@actions/core';
import * as github from '@actions/github';
import { Context } from '@actions/github/lib/context';

(async () => {
    try {
        const context: Context = github?.context;
        const token: string = core.getInput('token', { required: true });
        const ignoreDrafts: string = core.getInput('ignore-drafts', { required: false });
        const users: string[] = getCleanUsersList(context, core.getInput('users', { required: true }));

        if (!token) {
            return core.setFailed(`Required input "token" not provided`);
        }

        if (!users?.length) {
            return core.info(`Required input "users" not provided, at least one must be provided`);
        }

        if (isDraft(context) && ignoreDrafts) {
            return core.info(`Ignoring due to draft PR`);
        }

        if (!hasValidOwnerInContext(context)) {
            return core.setFailed(`Valid owner is missing from context`);
        }

        if (!hasValidRepoInContext(context)) {
            return core.setFailed(`Valid repo is missing from context`);
        }

        if (!hasValidPullRequestNumberInContext(context)) {
            return core.setFailed(`Valid Pull Request number is missing from context`);
        }

        core.setSecret(token);

        const octokit = github.getOctokit(token);
        await octokit.pulls.requestReviewers({
            owner: context?.repo?.owner,
            repo: context?.repo?.repo,
            pull_number: Number(context?.payload?.pull_request?.number),
            reviewers: users
        });

        core.info(`${JSON.stringify(users)} assigned for review of Pull Request #${context?.payload?.pull_request?.number} on ${context?.repo?.repo}`);

    } catch (error) {
        core.setFailed(error?.message);

        throw error;
    }
})();

function getCleanUsersList(context: Context, rawUserList: string = ``): string[] {
    let users: string[] = [...rawUserList?.split(',')?.map(user => user?.trim())];
    users = filterDuplicateUsers(users);
    users = filterPullRequestAuthor(context, users);
    users = filterExistingReviewers(context, users);

    return users;
}

function filterDuplicateUsers(users: string[] = []): string[] {
    return [...new Set(users)];
}

function filterPullRequestAuthor(context: Context, users: string[] = []): string[] {
    return [...users?.filter(user => user !== getPullRequestAuthor(context))];
}

function filterExistingReviewers(context: Context, users: string[] = []): string[] {
    const existingReviewers: string[] = getExistingReviewers(context);
    return [...users?.filter(user => existingReviewers.indexOf(user) === -1)];
}

function getPullRequestAuthor(context: Context): string {
    return context?.payload?.pull_request?.user?.login;
}

function hasValidOwnerInContext(context: Context): boolean {
    return !!context?.repo?.owner;
}

function hasValidRepoInContext(context: Context): boolean {
    return !!context?.repo?.repo;
}

function hasValidPullRequestNumberInContext(context: Context): boolean {
    return !!Number(context?.payload?.pull_request?.number);
}

function getExistingReviewers(context: Context): string[] | null {
    return context?.payload?.pull_request?.requested_reviewers;
}

function isDraft(context: Context): boolean {
    return context?.payload?.pull_request?.draft;
}