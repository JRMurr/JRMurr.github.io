<script lang="ts">
	import siteMetadata from '$lib/config/siteMetadata';
	import projectsData from '$lib/config/projectsData';
</script>

<svelte:head>
	<title>Projects | {siteMetadata.title}</title>
</svelte:head>

<div class="divide-y divide-gray-200 dark:divide-gray-700">
	<div class="space-y-2 pb-8 pt-6 md:space-y-5">
		<h1
			class="text-3xl font-extrabold leading-9 tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14"
		>
			Projects
		</h1>
		<p class="text-lg leading-7 text-gray-500 dark:text-gray-400">
			A [small] selection of my projects, mostly out of date... maybe ill update some day...
		</p>
	</div>
	<div class="container py-12">
		<div class="-m-4 flex flex-wrap">
			{#each projectsData as project}
				<div class="md max-w-[544px] p-4 md:w-1/2">
					<div class="overflow-hidden rounded-md border-2 border-gray-200 border-opacity-60 dark:border-gray-700">
						{#if project.imgSrc}
							{#if project.href}
								<a href={project.href} aria-label="Link to {project.title}">
									<img
										alt={project.title}
										src={project.imgSrc}
										class="object-cover object-center md:h-36 lg:h-48"
										width={544}
										height={306}
									/>
								</a>
							{:else}
								<img
									alt={project.title}
									src={project.imgSrc}
									class="object-cover object-center md:h-36 lg:h-48"
									width={544}
									height={306}
								/>
							{/if}
						{/if}
						<div class="p-6">
							<h2 class="mb-3 text-2xl font-bold leading-8 tracking-tight">
								{#if project.href}
									<a href={project.href} aria-label="Link to {project.title}">
										{project.title}
									</a>
								{:else}
									{project.title}
								{/if}
							</h2>
							<p class="prose mb-3 max-w-none text-gray-500 dark:text-gray-400">
								{project.description}
							</p>
							{#if project.href}
								<a
									href={project.href}
									class="text-base font-medium leading-6 text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
									aria-label="Link to {project.title}"
								>
									Learn more &rarr;
								</a>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
