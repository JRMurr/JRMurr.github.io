<script lang="ts">
	import siteMetadata from '$lib/config/siteMetadata';
	import SocialIcon from './SocialIcon.svelte';
</script>

<footer>
	<div class="mt-16 flex flex-col items-center">
		<div class="mb-3 flex space-x-4">
			<SocialIcon kind="mail" href="mailto:{siteMetadata.email}" size={6} />
			<SocialIcon kind="github" href={siteMetadata.github} size={6} />
			<SocialIcon kind="twitter" href={siteMetadata.twitter} size={6} />
			<SocialIcon kind="bsky" href={siteMetadata.bsky} size={6} />
			<SocialIcon kind="mastodon" href={siteMetadata.mastodon} size={6} />
			<SocialIcon kind="rss" href="/feed.xml" size={6} />
		</div>
		<div class="mb-2 flex space-x-2 text-sm text-gray-500 dark:text-gray-400">
			<div>{siteMetadata.author}</div>
			<div>{` • `}</div>
			<div>{`© ${new Date().getFullYear()}`}</div>
			<div>{` • `}</div>
			<a href="/">{siteMetadata.title}</a>
		</div>
	</div>
</footer>
