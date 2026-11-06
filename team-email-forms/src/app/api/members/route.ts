import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_TEAM_MEMBERS } from '@/lib/constants';
import { TeamMember } from '@/types';

// In-memory / module level store for the session
let membersStore: TeamMember[] = [...INITIAL_TEAM_MEMBERS];

export async function GET() {
  return NextResponse.json({
    success: true,
    count: membersStore.length,
    members: membersStore,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role, department, avatar, phone } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = membersStore.find((m) => m.email.toLowerCase() === cleanEmail);

    if (existing) {
      // Update existing member status / role
      existing.name = name || existing.name;
      existing.role = role || existing.role;
      existing.department = department || existing.department;
      existing.status = 'online';
      if (avatar) existing.avatar = avatar;
      if (phone) existing.phone = phone;

      return NextResponse.json({
        success: true,
        message: 'Member updated / logged in',
        member: existing,
        members: membersStore,
      });
    }

    const newMember: TeamMember = {
      id: `mem_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      role: role?.trim() || 'عضو فريق',
      department: department?.trim() || 'إدارة عامة',
      avatar:
        avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1e3a8a,0284c7,10b981`,
      status: 'online',
      phone: phone || '',
      registeredAt: new Date().toISOString().split('T')[0],
    };

    membersStore.unshift(newMember);

    return NextResponse.json({
      success: true,
      message: 'New member registered successfully',
      member: newMember,
      members: membersStore,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error processing request' }, { status: 500 });
  }
}
