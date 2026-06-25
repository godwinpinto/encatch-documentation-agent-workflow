import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col flex-1 justify-center px-4 py-8 text-center">
        <h1 className="font-medium text-xl mb-4">Encatch docs with a local agent workflow.</h1>
        <p className="text-fd-muted-foreground text-sm mb-6 max-w-md mx-auto">
          Sample Fumadocs site. GitHub issues can be triaged and fixed by the local Cursor agent in{' '}
          <code className="text-xs">.encatch/workflow/</code>.
        </p>
        <Link
          to="/docs/$"
          params={{
            _splat: '',
          }}
          className="px-3 py-2 rounded-lg bg-brand text-brand-foreground font-medium text-sm mx-auto hover:bg-brand-200 transition-colors"
        >
          Open Docs
        </Link>
      </div>
    </HomeLayout>
  );
}
